/**
 * @file Unit тесты для SanitizationMode
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';
import {
  compareModes,
  createSanitizationModeRegistry,
  defaultSanitizationModeRegistry,
  getSanitizationModeName,
  isSanitizationMode,
  isStricter,
  lenientMode,
  sanitizationModes,
  stricterMode,
} from '../../src/data-safety/sanitization-mode.js';
import type { SanitizationMode } from '../../src/data-safety/sanitization-mode.js';

describe('SanitizationMode', () => {
  describe('sanitizationModes константы', () => {
    it('содержит все базовые режимы', () => {
      expect(sanitizationModes.NONE).toBeDefined();
      expect(sanitizationModes.BASIC).toBeDefined();
      expect(sanitizationModes.STRICT).toBeDefined();
      expect(sanitizationModes.PII_REDACTION).toBeDefined();
    });

    it('каждый режим является уникальным Symbol', () => {
      expect(sanitizationModes.NONE).not.toBe(sanitizationModes.BASIC);
      expect(sanitizationModes.BASIC).not.toBe(sanitizationModes.STRICT);
      expect(sanitizationModes.STRICT).not.toBe(sanitizationModes.PII_REDACTION);
      expect(sanitizationModes.NONE).not.toBe(sanitizationModes.STRICT);
    });

    it('режимы являются Symbol', () => {
      expect(typeof sanitizationModes.NONE).toBe('symbol');
      expect(typeof sanitizationModes.BASIC).toBe('symbol');
      expect(typeof sanitizationModes.STRICT).toBe('symbol');
      expect(typeof sanitizationModes.PII_REDACTION).toBe('symbol');
    });
  });

  describe('createSanitizationModeRegistry', () => {
    it('создает новый Builder', () => {
      const builder = createSanitizationModeRegistry();
      expect(builder).toBeDefined();
      expect(builder.withMode).toBeDefined();
      expect(builder.build).toBeDefined();
    });

    it('Builder.withMode возвращает новый Builder', () => {
      const builder = createSanitizationModeRegistry();
      const newBuilder = builder.withMode(
        sanitizationModes.NONE as SanitizationMode,
        'NONE',
      );
      expect(newBuilder).not.toBe(builder);
      expect(newBuilder).toBeDefined();
    });

    it('Builder.withMode добавляет режимы в правильном порядке', () => {
      const registry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .withMode(sanitizationModes.BASIC as SanitizationMode, 'BASIC')
        .withMode(sanitizationModes.STRICT as SanitizationMode, 'STRICT')
        .build();

      expect(registry.order).toHaveLength(3);
      expect(registry.order[0]).toBe(sanitizationModes.NONE);
      expect(registry.order[1]).toBe(sanitizationModes.BASIC);
      expect(registry.order[2]).toBe(sanitizationModes.STRICT);
    });

    it('Builder.withMode создает правильные Maps', () => {
      const registry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .withMode(sanitizationModes.BASIC as SanitizationMode, 'BASIC')
        .build();

      expect(registry.orderIndexMap.get(sanitizationModes.NONE as SanitizationMode)).toBe(0);
      expect(registry.orderIndexMap.get(sanitizationModes.BASIC as SanitizationMode)).toBe(1);
      expect(registry.modeNames.get(sanitizationModes.NONE as SanitizationMode)).toBe('NONE');
      expect(registry.modeNames.get(sanitizationModes.BASIC as SanitizationMode)).toBe('BASIC');
      expect(registry.nameToModeMap.get('NONE')).toBe(sanitizationModes.NONE);
      expect(registry.nameToModeMap.get('BASIC')).toBe(sanitizationModes.BASIC);
    });

    it('Builder.withMode выбрасывает ошибку при дубликате режима', () => {
      const builder = createSanitizationModeRegistry().withMode(
        sanitizationModes.NONE as SanitizationMode,
        'NONE',
      );

      expect(() => {
        builder.withMode(sanitizationModes.NONE as SanitizationMode, 'DUPLICATE');
      }).toThrow('SanitizationMode уже добавлен в registry');
    });

    it('Builder.withMode выбрасывает ошибку при дубликате имени', () => {
      const builder = createSanitizationModeRegistry().withMode(
        sanitizationModes.NONE as SanitizationMode,
        'NONE',
      );

      expect(() => {
        builder.withMode(sanitizationModes.BASIC as SanitizationMode, 'NONE');
      }).toThrow('Имя режима санитизации уже используется');
    });

    it('Builder.build выбрасывает ошибку для пустого registry', () => {
      const builder = createSanitizationModeRegistry();
      expect(() => builder.build()).toThrow(
        'SanitizationModeRegistry не может быть пустым',
      );
    });

    it('Builder.build создает immutable registry', () => {
      const registry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .build();

      expect(() => {
        // @ts-expect-error - проверка immutability
        registry.order.push(sanitizationModes.BASIC as SanitizationMode);
      }).toThrow();
    });

    it('Builder поддерживает цепочку вызовов', () => {
      const registry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .withMode(sanitizationModes.BASIC as SanitizationMode, 'BASIC')
        .withMode(sanitizationModes.STRICT as SanitizationMode, 'STRICT')
        .build();

      expect(registry.order).toHaveLength(3);
    });
  });

  describe('defaultSanitizationModeRegistry', () => {
    it('создается с базовыми режимами', () => {
      expect(defaultSanitizationModeRegistry.order).toHaveLength(4);
      expect(defaultSanitizationModeRegistry.order[0]).toBe(sanitizationModes.NONE);
      expect(defaultSanitizationModeRegistry.order[1]).toBe(sanitizationModes.BASIC);
      expect(defaultSanitizationModeRegistry.order[2]).toBe(sanitizationModes.STRICT);
      expect(defaultSanitizationModeRegistry.order[3]).toBe(sanitizationModes.PII_REDACTION);
    });

    it('содержит правильные индексы', () => {
      expect(
        defaultSanitizationModeRegistry.orderIndexMap.get(
          sanitizationModes.NONE as SanitizationMode,
        ),
      ).toBe(0);
      expect(
        defaultSanitizationModeRegistry.orderIndexMap.get(
          sanitizationModes.BASIC as SanitizationMode,
        ),
      ).toBe(1);
      expect(
        defaultSanitizationModeRegistry.orderIndexMap.get(
          sanitizationModes.STRICT as SanitizationMode,
        ),
      ).toBe(2);
      expect(
        defaultSanitizationModeRegistry.orderIndexMap.get(
          sanitizationModes.PII_REDACTION as SanitizationMode,
        ),
      ).toBe(3);
    });

    it('содержит правильные имена', () => {
      expect(
        defaultSanitizationModeRegistry.modeNames.get(
          sanitizationModes.NONE as SanitizationMode,
        ),
      ).toBe('NONE');
      expect(
        defaultSanitizationModeRegistry.modeNames.get(
          sanitizationModes.BASIC as SanitizationMode,
        ),
      ).toBe('BASIC');
      expect(
        defaultSanitizationModeRegistry.modeNames.get(
          sanitizationModes.STRICT as SanitizationMode,
        ),
      ).toBe('STRICT');
      expect(
        defaultSanitizationModeRegistry.modeNames.get(
          sanitizationModes.PII_REDACTION as SanitizationMode,
        ),
      ).toBe('PII_REDACTION');
    });
  });

  describe('getSanitizationModeName', () => {
    it('возвращает имя для известного режима', () => {
      expect(getSanitizationModeName(sanitizationModes.NONE as SanitizationMode)).toBe('NONE');
      expect(getSanitizationModeName(sanitizationModes.BASIC as SanitizationMode)).toBe('BASIC');
      expect(getSanitizationModeName(sanitizationModes.STRICT as SanitizationMode)).toBe(
        'STRICT',
      );
      expect(
        getSanitizationModeName(sanitizationModes.PII_REDACTION as SanitizationMode),
      ).toBe('PII_REDACTION');
    });

    it('возвращает UNKNOWN для неизвестного режима', () => {
      const unknownMode = Symbol('UNKNOWN') as SanitizationMode;
      expect(getSanitizationModeName(unknownMode)).toBe('UNKNOWN');
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'CUSTOM_NONE')
        .build();

      expect(getSanitizationModeName(sanitizationModes.NONE as SanitizationMode, customRegistry))
        .toBe(
          'CUSTOM_NONE',
        );
    });
  });

  describe('isSanitizationMode', () => {
    it('возвращает true для валидных режимов', () => {
      expect(isSanitizationMode(sanitizationModes.NONE)).toBe(true);
      expect(isSanitizationMode(sanitizationModes.BASIC)).toBe(true);
      expect(isSanitizationMode(sanitizationModes.STRICT)).toBe(true);
      expect(isSanitizationMode(sanitizationModes.PII_REDACTION)).toBe(true);
    });

    it('возвращает false для неизвестных значений', () => {
      expect(isSanitizationMode(Symbol('UNKNOWN'))).toBe(false);
      expect(isSanitizationMode('string')).toBe(false);
      expect(isSanitizationMode(123)).toBe(false);
      expect(isSanitizationMode(null)).toBe(false);
      expect(isSanitizationMode(undefined)).toBe(false);
      expect(isSanitizationMode({})).toBe(false);
      expect(isSanitizationMode([])).toBe(false);
    });

    it('защищает от NaN', () => {
      expect(isSanitizationMode(NaN)).toBe(false);
    });

    it('защищает от Infinity', () => {
      expect(isSanitizationMode(Infinity)).toBe(false);
      expect(isSanitizationMode(-Infinity)).toBe(false);
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .build();

      expect(isSanitizationMode(sanitizationModes.NONE, customRegistry)).toBe(true);
      expect(isSanitizationMode(sanitizationModes.BASIC, customRegistry)).toBe(false);
    });
  });

  describe('compareModes', () => {
    it('вызывает comparatorFn с правильными индексами', () => {
      const comparatorFn = (indexA: number, indexB: number): number => indexA - indexB;
      const result = compareModes(
        sanitizationModes.BASIC as SanitizationMode,
        sanitizationModes.STRICT as SanitizationMode,
        comparatorFn,
      );
      expect(result).toBe(-1); // 1 - 2 = -1
    });

    it('работает с кастомным comparatorFn', () => {
      const customComparator = (idxA: number, idxB: number): boolean => idxA > idxB;
      const result = compareModes(
        sanitizationModes.STRICT as SanitizationMode,
        sanitizationModes.BASIC as SanitizationMode,
        customComparator,
      );
      expect(result).toBe(true);
    });

    it('выбрасывает ошибку для неизвестного режима a', () => {
      const unknownMode = Symbol('UNKNOWN') as SanitizationMode;
      expect(() => {
        compareModes(unknownMode, sanitizationModes.NONE as SanitizationMode, (a, b) => a - b);
      }).toThrow('Unknown SanitizationMode detected in compareModes');
    });

    it('выбрасывает ошибку для неизвестного режима b', () => {
      const unknownMode = Symbol('UNKNOWN') as SanitizationMode;
      expect(() => {
        compareModes(sanitizationModes.NONE as SanitizationMode, unknownMode, (a, b) => a - b);
      }).toThrow('Unknown SanitizationMode detected in compareModes');
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .withMode(sanitizationModes.STRICT as SanitizationMode, 'STRICT')
        .build();

      const result = compareModes(
        sanitizationModes.NONE as SanitizationMode,
        sanitizationModes.STRICT as SanitizationMode,
        (a, b) => a - b,
        customRegistry,
      );
      expect(result).toBe(-1);
    });

    it('выбрасывает ошибку для режима не из кастомного registry', () => {
      const customRegistry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .build();

      expect(() => {
        compareModes(
          sanitizationModes.NONE as SanitizationMode,
          sanitizationModes.BASIC as SanitizationMode,
          (a, b) => a - b,
          customRegistry,
        );
      }).toThrow('Unknown SanitizationMode detected in compareModes');
    });
  });

  describe('isStricter', () => {
    it('возвращает true когда a строже b', () => {
      expect(
        isStricter(
          sanitizationModes.STRICT as SanitizationMode,
          sanitizationModes.BASIC as SanitizationMode,
        ),
      ).toBe(true);
      expect(
        isStricter(
          sanitizationModes.PII_REDACTION as SanitizationMode,
          sanitizationModes.NONE as SanitizationMode,
        ),
      ).toBe(true);
      expect(
        isStricter(
          sanitizationModes.BASIC as SanitizationMode,
          sanitizationModes.NONE as SanitizationMode,
        ),
      ).toBe(true);
    });

    it('возвращает false когда a не строже b', () => {
      expect(
        isStricter(
          sanitizationModes.BASIC as SanitizationMode,
          sanitizationModes.STRICT as SanitizationMode,
        ),
      ).toBe(false);
      expect(
        isStricter(
          sanitizationModes.NONE as SanitizationMode,
          sanitizationModes.PII_REDACTION as SanitizationMode,
        ),
      ).toBe(false);
    });

    it('возвращает false для одинаковых режимов', () => {
      expect(
        isStricter(
          sanitizationModes.NONE as SanitizationMode,
          sanitizationModes.NONE as SanitizationMode,
        ),
      ).toBe(false);
      expect(
        isStricter(
          sanitizationModes.STRICT as SanitizationMode,
          sanitizationModes.STRICT as SanitizationMode,
        ),
      ).toBe(false);
    });

    it('выбрасывает ошибку для неизвестного режима a', () => {
      const unknownMode = Symbol('UNKNOWN') as SanitizationMode;
      expect(() => {
        isStricter(unknownMode, sanitizationModes.NONE as SanitizationMode);
      }).toThrow('Unknown SanitizationMode detected in isStricter');
    });

    it('выбрасывает ошибку для неизвестного режима b', () => {
      const unknownMode = Symbol('UNKNOWN') as SanitizationMode;
      expect(() => {
        isStricter(sanitizationModes.NONE as SanitizationMode, unknownMode);
      }).toThrow('Unknown SanitizationMode detected in isStricter');
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .withMode(sanitizationModes.STRICT as SanitizationMode, 'STRICT')
        .build();

      expect(
        isStricter(
          sanitizationModes.STRICT as SanitizationMode,
          sanitizationModes.NONE as SanitizationMode,
          customRegistry,
        ),
      ).toBe(true);
    });

    it('выбрасывает ошибку с информацией о default registry', () => {
      const unknownMode = Symbol('UNKNOWN') as SanitizationMode;
      try {
        isStricter(unknownMode, sanitizationModes.NONE as SanitizationMode);
      } catch (error) {
        expect((error as Error).message).toContain('defaultSanitizationModeRegistry');
      }
    });

    it('выбрасывает ошибку с информацией о custom registry', () => {
      const customRegistry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .build();

      const unknownMode = Symbol('UNKNOWN') as SanitizationMode;
      try {
        isStricter(unknownMode, sanitizationModes.NONE as SanitizationMode, customRegistry);
      } catch (error) {
        expect((error as Error).message).toContain('custom registry with 1 modes');
      }
    });
  });

  describe('stricterMode', () => {
    it('возвращает более строгий режим', () => {
      expect(
        stricterMode(
          sanitizationModes.BASIC as SanitizationMode,
          sanitizationModes.STRICT as SanitizationMode,
        ),
      ).toBe(sanitizationModes.STRICT);
      expect(
        stricterMode(
          sanitizationModes.NONE as SanitizationMode,
          sanitizationModes.PII_REDACTION as SanitizationMode,
        ),
      ).toBe(sanitizationModes.PII_REDACTION);
    });

    it('возвращает a если a строже b', () => {
      expect(
        stricterMode(
          sanitizationModes.STRICT as SanitizationMode,
          sanitizationModes.BASIC as SanitizationMode,
        ),
      ).toBe(sanitizationModes.STRICT);
    });

    it('возвращает b если b строже a', () => {
      expect(
        stricterMode(
          sanitizationModes.BASIC as SanitizationMode,
          sanitizationModes.STRICT as SanitizationMode,
        ),
      ).toBe(sanitizationModes.STRICT);
    });

    it('возвращает любой из одинаковых режимов', () => {
      const result = stricterMode(
        sanitizationModes.NONE as SanitizationMode,
        sanitizationModes.NONE as SanitizationMode,
      );
      expect(result).toBe(sanitizationModes.NONE);
    });

    it('выбрасывает ошибку для неизвестного режима', () => {
      const unknownMode = Symbol('UNKNOWN') as SanitizationMode;
      expect(() => {
        stricterMode(unknownMode, sanitizationModes.NONE as SanitizationMode);
      }).toThrow('Unknown SanitizationMode detected in stricterMode');
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .withMode(sanitizationModes.STRICT as SanitizationMode, 'STRICT')
        .build();

      const result = stricterMode(
        sanitizationModes.NONE as SanitizationMode,
        sanitizationModes.STRICT as SanitizationMode,
        customRegistry,
      );
      expect(result).toBe(sanitizationModes.STRICT);
    });
  });

  describe('lenientMode', () => {
    it('возвращает менее строгий режим', () => {
      expect(
        lenientMode(
          sanitizationModes.BASIC as SanitizationMode,
          sanitizationModes.STRICT as SanitizationMode,
        ),
      ).toBe(sanitizationModes.BASIC);
      expect(
        lenientMode(
          sanitizationModes.NONE as SanitizationMode,
          sanitizationModes.PII_REDACTION as SanitizationMode,
        ),
      ).toBe(sanitizationModes.NONE);
    });

    it('возвращает a если a менее строгий чем b', () => {
      expect(
        lenientMode(
          sanitizationModes.BASIC as SanitizationMode,
          sanitizationModes.STRICT as SanitizationMode,
        ),
      ).toBe(sanitizationModes.BASIC);
    });

    it('возвращает b если b менее строгий чем a', () => {
      expect(
        lenientMode(
          sanitizationModes.STRICT as SanitizationMode,
          sanitizationModes.BASIC as SanitizationMode,
        ),
      ).toBe(sanitizationModes.BASIC);
    });

    it('возвращает любой из одинаковых режимов', () => {
      const result = lenientMode(
        sanitizationModes.NONE as SanitizationMode,
        sanitizationModes.NONE as SanitizationMode,
      );
      expect(result).toBe(sanitizationModes.NONE);
    });

    it('выбрасывает ошибку для неизвестного режима', () => {
      const unknownMode = Symbol('UNKNOWN') as SanitizationMode;
      expect(() => {
        lenientMode(unknownMode, sanitizationModes.NONE as SanitizationMode);
      }).toThrow('Unknown SanitizationMode detected in lenientMode');
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .withMode(sanitizationModes.STRICT as SanitizationMode, 'STRICT')
        .build();

      const result = lenientMode(
        sanitizationModes.NONE as SanitizationMode,
        sanitizationModes.STRICT as SanitizationMode,
        customRegistry,
      );
      expect(result).toBe(sanitizationModes.NONE);
    });
  });

  describe('Multi-registry архитектура', () => {
    it('создает независимые registry', () => {
      const registry1 = createSanitizationModeRegistry()
        .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
        .build();

      const registry2 = createSanitizationModeRegistry()
        .withMode(sanitizationModes.BASIC as SanitizationMode, 'BASIC')
        .build();

      expect(registry1).not.toBe(registry2);
      expect(registry1.order).toHaveLength(1);
      expect(registry2.order).toHaveLength(1);
    });

    it('каждый registry имеет свои режимы', () => {
      const customMode1 = Symbol('CUSTOM1') as SanitizationMode;
      const customMode2 = Symbol('CUSTOM2') as SanitizationMode;

      const registry1 = createSanitizationModeRegistry()
        .withMode(customMode1, 'CUSTOM1')
        .build();

      const registry2 = createSanitizationModeRegistry()
        .withMode(customMode2, 'CUSTOM2')
        .build();

      expect(isSanitizationMode(customMode1, registry1)).toBe(true);
      expect(isSanitizationMode(customMode1, registry2)).toBe(false);
      expect(isSanitizationMode(customMode2, registry1)).toBe(false);
      expect(isSanitizationMode(customMode2, registry2)).toBe(true);
    });
  });

  describe('Edge cases и защита от подделок', () => {
    it('isSanitizationMode защищает от подделки через строку', () => {
      expect(isSanitizationMode('NONE')).toBe(false);
      expect(isSanitizationMode('BASIC')).toBe(false);
    });

    it('isSanitizationMode защищает от подделки через число', () => {
      expect(isSanitizationMode(0)).toBe(false);
      expect(isSanitizationMode(1)).toBe(false);
      expect(isSanitizationMode(2)).toBe(false);
      expect(isSanitizationMode(3)).toBe(false);
    });

    it('isSanitizationMode защищает от подделки через объект', () => {
      expect(isSanitizationMode({ mode: 'NONE' })).toBe(false);
    });

    it('getSanitizationModeName возвращает UNKNOWN для поддельного режима', () => {
      const fakeMode = Symbol('FAKE') as SanitizationMode;
      expect(getSanitizationModeName(fakeMode)).toBe('UNKNOWN');
    });

    it('isStricter выбрасывает ошибку для поддельного режима', () => {
      const fakeMode = Symbol('FAKE') as SanitizationMode;
      expect(() => {
        isStricter(fakeMode, sanitizationModes.NONE as SanitizationMode);
      }).toThrow();
    });

    it('stricterMode выбрасывает ошибку для поддельного режима', () => {
      const fakeMode = Symbol('FAKE') as SanitizationMode;
      expect(() => {
        stricterMode(fakeMode, sanitizationModes.NONE as SanitizationMode);
      }).toThrow();
    });

    it('lenientMode выбрасывает ошибку для поддельного режима', () => {
      const fakeMode = Symbol('FAKE') as SanitizationMode;
      expect(() => {
        lenientMode(fakeMode, sanitizationModes.NONE as SanitizationMode);
      }).toThrow();
    });
  });

  describe('Все комбинации режимов', () => {
    it('isStricter покрывает все пары режимов', () => {
      const modes = [
        sanitizationModes.NONE,
        sanitizationModes.BASIC,
        sanitizationModes.STRICT,
        sanitizationModes.PII_REDACTION,
      ] as SanitizationMode[];

      const pairs = modes.flatMap((modeA, i) => modes.map((modeB, j) => ({ modeA, modeB, i, j })));

      pairs.forEach(({ modeA, modeB, i, j }) => {
        const result = isStricter(modeA, modeB);
        if (i > j) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      });
    });

    it('stricterMode покрывает все пары режимов', () => {
      const modes = [
        sanitizationModes.NONE,
        sanitizationModes.BASIC,
        sanitizationModes.STRICT,
        sanitizationModes.PII_REDACTION,
      ] as SanitizationMode[];

      const pairs = modes.flatMap((modeA, i) => modes.map((modeB, j) => ({ modeA, modeB, i, j })));

      pairs.forEach(({ modeA, modeB, i, j }) => {
        const result = stricterMode(modeA, modeB);
        const expected = i > j ? modeA : modeB;
        expect(result).toBe(expected);
      });
    });

    it('lenientMode покрывает все пары режимов', () => {
      const modes = [
        sanitizationModes.NONE,
        sanitizationModes.BASIC,
        sanitizationModes.STRICT,
        sanitizationModes.PII_REDACTION,
      ] as SanitizationMode[];

      const pairs = modes.flatMap((modeA, i) => modes.map((modeB, j) => ({ modeA, modeB, i, j })));

      pairs.forEach(({ modeA, modeB, i, j }) => {
        const result = lenientMode(modeA, modeB);
        const expected = i < j ? modeA : modeB;
        expect(result).toBe(expected);
      });
    });
  });
});
