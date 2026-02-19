/**
 * @file Unit тесты для TrustLevel
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';
import {
  createTrustLevelRegistry,
  defaultTrustLevelRegistry,
  dominates,
  getTrustLevelName,
  isTrustLevel,
  meetTrust,
  trustLevels,
} from '../../src/data-safety/trust-level.js';
import type { TrustLevel } from '../../src/data-safety/trust-level.js';

describe('TrustLevel', () => {
  describe('trustLevels константы', () => {
    it('содержит все базовые уровни', () => {
      expect(trustLevels.UNTRUSTED).toBeDefined();
      expect(trustLevels.PARTIAL).toBeDefined();
      expect(trustLevels.TRUSTED).toBeDefined();
    });

    it('каждый уровень является уникальным Symbol', () => {
      expect(trustLevels.UNTRUSTED).not.toBe(trustLevels.PARTIAL);
      expect(trustLevels.PARTIAL).not.toBe(trustLevels.TRUSTED);
      expect(trustLevels.UNTRUSTED).not.toBe(trustLevels.TRUSTED);
    });

    it('уровни являются Symbol', () => {
      expect(typeof trustLevels.UNTRUSTED).toBe('symbol');
      expect(typeof trustLevels.PARTIAL).toBe('symbol');
      expect(typeof trustLevels.TRUSTED).toBe('symbol');
    });
  });

  describe('createTrustLevelRegistry', () => {
    it('создает новый Builder', () => {
      const builder = createTrustLevelRegistry();
      expect(builder).toBeDefined();
      expect(builder.withLevel).toBeDefined();
      expect(builder.build).toBeDefined();
    });

    it('Builder.withLevel возвращает новый Builder', () => {
      const builder = createTrustLevelRegistry();
      const newBuilder = builder.withLevel(
        trustLevels.UNTRUSTED as TrustLevel,
        'UNTRUSTED',
      );
      expect(newBuilder).not.toBe(builder);
      expect(newBuilder).toBeDefined();
    });

    it('Builder.withLevel добавляет уровни в правильном порядке', () => {
      const registry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .withLevel(trustLevels.PARTIAL as TrustLevel, 'PARTIAL')
        .withLevel(trustLevels.TRUSTED as TrustLevel, 'TRUSTED')
        .build();

      expect(registry.order).toHaveLength(3);
      expect(registry.order[0]).toBe(trustLevels.UNTRUSTED);
      expect(registry.order[1]).toBe(trustLevels.PARTIAL);
      expect(registry.order[2]).toBe(trustLevels.TRUSTED);
    });

    it('Builder.withLevel создает правильные Maps', () => {
      const registry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .withLevel(trustLevels.PARTIAL as TrustLevel, 'PARTIAL')
        .build();

      expect(registry.orderIndexMap.get(trustLevels.UNTRUSTED as TrustLevel)).toBe(0);
      expect(registry.orderIndexMap.get(trustLevels.PARTIAL as TrustLevel)).toBe(1);
      expect(registry.trustLevelNames.get(trustLevels.UNTRUSTED as TrustLevel)).toBe(
        'UNTRUSTED',
      );
      expect(registry.trustLevelNames.get(trustLevels.PARTIAL as TrustLevel)).toBe('PARTIAL');
      expect(registry.nameToLevelMap.get('UNTRUSTED')).toBe(trustLevels.UNTRUSTED);
      expect(registry.nameToLevelMap.get('PARTIAL')).toBe(trustLevels.PARTIAL);
    });

    it('Builder.withLevel выбрасывает ошибку при дубликате уровня', () => {
      const builder = createTrustLevelRegistry().withLevel(
        trustLevels.UNTRUSTED as TrustLevel,
        'UNTRUSTED',
      );

      expect(() => {
        builder.withLevel(trustLevels.UNTRUSTED as TrustLevel, 'DUPLICATE');
      }).toThrow('TrustLevel уже добавлен в registry');
    });

    it('Builder.withLevel выбрасывает ошибку при дубликате имени', () => {
      const builder = createTrustLevelRegistry().withLevel(
        trustLevels.UNTRUSTED as TrustLevel,
        'UNTRUSTED',
      );

      expect(() => {
        builder.withLevel(trustLevels.PARTIAL as TrustLevel, 'UNTRUSTED');
      }).toThrow('Имя уровня доверия уже используется');
    });

    it('Builder.build выбрасывает ошибку для пустого registry', () => {
      const builder = createTrustLevelRegistry();
      expect(() => builder.build()).toThrow(
        'TrustLevelRegistry не может быть пустым',
      );
    });

    it('Builder.build создает immutable registry', () => {
      const registry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .build();

      expect(() => {
        // @ts-expect-error - проверка immutability
        registry.order.push(trustLevels.PARTIAL as TrustLevel);
      }).toThrow();
    });

    it('Builder поддерживает цепочку вызовов', () => {
      const registry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .withLevel(trustLevels.PARTIAL as TrustLevel, 'PARTIAL')
        .withLevel(trustLevels.TRUSTED as TrustLevel, 'TRUSTED')
        .build();

      expect(registry.order).toHaveLength(3);
    });
  });

  describe('defaultTrustLevelRegistry', () => {
    it('создается с базовыми уровнями', () => {
      expect(defaultTrustLevelRegistry.order).toHaveLength(3);
      expect(defaultTrustLevelRegistry.order[0]).toBe(trustLevels.UNTRUSTED);
      expect(defaultTrustLevelRegistry.order[1]).toBe(trustLevels.PARTIAL);
      expect(defaultTrustLevelRegistry.order[2]).toBe(trustLevels.TRUSTED);
    });

    it('содержит правильные индексы', () => {
      expect(
        defaultTrustLevelRegistry.orderIndexMap.get(trustLevels.UNTRUSTED as TrustLevel),
      ).toBe(0);
      expect(
        defaultTrustLevelRegistry.orderIndexMap.get(trustLevels.PARTIAL as TrustLevel),
      ).toBe(1);
      expect(
        defaultTrustLevelRegistry.orderIndexMap.get(trustLevels.TRUSTED as TrustLevel),
      ).toBe(2);
    });

    it('содержит правильные имена', () => {
      expect(
        defaultTrustLevelRegistry.trustLevelNames.get(trustLevels.UNTRUSTED as TrustLevel),
      ).toBe('UNTRUSTED');
      expect(
        defaultTrustLevelRegistry.trustLevelNames.get(trustLevels.PARTIAL as TrustLevel),
      ).toBe('PARTIAL');
      expect(
        defaultTrustLevelRegistry.trustLevelNames.get(trustLevels.TRUSTED as TrustLevel),
      ).toBe('TRUSTED');
    });
  });

  describe('getTrustLevelName', () => {
    it('возвращает имя для известного уровня', () => {
      expect(getTrustLevelName(trustLevels.UNTRUSTED as TrustLevel)).toBe('UNTRUSTED');
      expect(getTrustLevelName(trustLevels.PARTIAL as TrustLevel)).toBe('PARTIAL');
      expect(getTrustLevelName(trustLevels.TRUSTED as TrustLevel)).toBe('TRUSTED');
    });

    it('возвращает UNKNOWN для неизвестного уровня', () => {
      const unknownLevel = Symbol('UNKNOWN') as TrustLevel;
      expect(getTrustLevelName(unknownLevel)).toBe('UNKNOWN');
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'CUSTOM_UNTRUSTED')
        .build();

      expect(getTrustLevelName(trustLevels.UNTRUSTED as TrustLevel, customRegistry)).toBe(
        'CUSTOM_UNTRUSTED',
      );
    });
  });

  describe('isTrustLevel', () => {
    it('возвращает true для валидных уровней', () => {
      expect(isTrustLevel(trustLevels.UNTRUSTED)).toBe(true);
      expect(isTrustLevel(trustLevels.PARTIAL)).toBe(true);
      expect(isTrustLevel(trustLevels.TRUSTED)).toBe(true);
    });

    it('возвращает false для неизвестных значений', () => {
      expect(isTrustLevel(Symbol('UNKNOWN'))).toBe(false);
      expect(isTrustLevel('string')).toBe(false);
      expect(isTrustLevel(123)).toBe(false);
      expect(isTrustLevel(null)).toBe(false);
      expect(isTrustLevel(undefined)).toBe(false);
      expect(isTrustLevel({})).toBe(false);
      expect(isTrustLevel([])).toBe(false);
    });

    it('защищает от NaN', () => {
      expect(isTrustLevel(NaN)).toBe(false);
    });

    it('защищает от Infinity', () => {
      expect(isTrustLevel(Infinity)).toBe(false);
      expect(isTrustLevel(-Infinity)).toBe(false);
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .build();

      expect(isTrustLevel(trustLevels.UNTRUSTED, customRegistry)).toBe(true);
      expect(isTrustLevel(trustLevels.PARTIAL, customRegistry)).toBe(false);
    });
  });

  describe('meetTrust', () => {
    it('возвращает UNTRUSTED при meet(UNTRUSTED, TRUSTED)', () => {
      const result = meetTrust(
        trustLevels.UNTRUSTED as TrustLevel,
        trustLevels.TRUSTED as TrustLevel,
      );
      expect(result).toBe(trustLevels.UNTRUSTED);
    });

    it('возвращает UNTRUSTED при meet(TRUSTED, UNTRUSTED) - коммутативность', () => {
      const result = meetTrust(
        trustLevels.TRUSTED as TrustLevel,
        trustLevels.UNTRUSTED as TrustLevel,
      );
      expect(result).toBe(trustLevels.UNTRUSTED);
    });

    it('возвращает PARTIAL при meet(PARTIAL, TRUSTED)', () => {
      const result = meetTrust(
        trustLevels.PARTIAL as TrustLevel,
        trustLevels.TRUSTED as TrustLevel,
      );
      expect(result).toBe(trustLevels.PARTIAL);
    });

    it('возвращает UNTRUSTED при meet(UNTRUSTED, PARTIAL)', () => {
      const result = meetTrust(
        trustLevels.UNTRUSTED as TrustLevel,
        trustLevels.PARTIAL as TrustLevel,
      );
      expect(result).toBe(trustLevels.UNTRUSTED);
    });

    it('возвращает тот же уровень при meet(a, a) - идемпотентность', () => {
      expect(meetTrust(trustLevels.UNTRUSTED as TrustLevel, trustLevels.UNTRUSTED as TrustLevel))
        .toBe(
          trustLevels.UNTRUSTED,
        );
      expect(meetTrust(trustLevels.PARTIAL as TrustLevel, trustLevels.PARTIAL as TrustLevel)).toBe(
        trustLevels.PARTIAL,
      );
      expect(meetTrust(trustLevels.TRUSTED as TrustLevel, trustLevels.TRUSTED as TrustLevel)).toBe(
        trustLevels.TRUSTED,
      );
    });

    it('ассоциативна: meet(a, meet(b, c)) === meet(meet(a, b), c)', () => {
      const a = trustLevels.UNTRUSTED as TrustLevel;
      const b = trustLevels.PARTIAL as TrustLevel;
      const c = trustLevels.TRUSTED as TrustLevel;

      const left = meetTrust(a, meetTrust(b, c));
      const right = meetTrust(meetTrust(a, b), c);
      expect(left).toBe(right);
    });

    it('выбрасывает ошибку для неизвестного уровня a', () => {
      const unknownLevel = Symbol('UNKNOWN') as TrustLevel;
      expect(() => {
        meetTrust(unknownLevel, trustLevels.UNTRUSTED as TrustLevel);
      }).toThrow('Unknown TrustLevel detected in meetTrust');
    });

    it('выбрасывает ошибку для неизвестного уровня b', () => {
      const unknownLevel = Symbol('UNKNOWN') as TrustLevel;
      expect(() => {
        meetTrust(trustLevels.UNTRUSTED as TrustLevel, unknownLevel);
      }).toThrow('Unknown TrustLevel detected in meetTrust');
    });

    it('выбрасывает ошибку для обоих неизвестных уровней', () => {
      const unknownLevel1 = Symbol('UNKNOWN1') as TrustLevel;
      const unknownLevel2 = Symbol('UNKNOWN2') as TrustLevel;
      expect(() => {
        meetTrust(unknownLevel1, unknownLevel2);
      }).toThrow('Unknown TrustLevel detected in meetTrust');
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .withLevel(trustLevels.TRUSTED as TrustLevel, 'TRUSTED')
        .build();

      const result = meetTrust(
        trustLevels.UNTRUSTED as TrustLevel,
        trustLevels.TRUSTED as TrustLevel,
        customRegistry,
      );
      expect(result).toBe(trustLevels.UNTRUSTED);
    });

    it('выбрасывает ошибку для уровня не из кастомного registry', () => {
      const customRegistry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .build();

      expect(() => {
        meetTrust(
          trustLevels.UNTRUSTED as TrustLevel,
          trustLevels.PARTIAL as TrustLevel,
          customRegistry,
        );
      }).toThrow('Unknown TrustLevel detected in meetTrust');
    });
  });

  describe('dominates', () => {
    it('TRUSTED доминирует над UNTRUSTED', () => {
      expect(
        dominates(trustLevels.TRUSTED as TrustLevel, trustLevels.UNTRUSTED as TrustLevel),
      ).toBe(true);
    });

    it('TRUSTED доминирует над PARTIAL', () => {
      expect(
        dominates(trustLevels.TRUSTED as TrustLevel, trustLevels.PARTIAL as TrustLevel),
      ).toBe(true);
    });

    it('PARTIAL доминирует над UNTRUSTED', () => {
      expect(
        dominates(trustLevels.PARTIAL as TrustLevel, trustLevels.UNTRUSTED as TrustLevel),
      ).toBe(true);
    });

    it('уровень доминирует над самим собой', () => {
      expect(
        dominates(trustLevels.UNTRUSTED as TrustLevel, trustLevels.UNTRUSTED as TrustLevel),
      ).toBe(true);
      expect(dominates(trustLevels.PARTIAL as TrustLevel, trustLevels.PARTIAL as TrustLevel)).toBe(
        true,
      );
      expect(dominates(trustLevels.TRUSTED as TrustLevel, trustLevels.TRUSTED as TrustLevel)).toBe(
        true,
      );
    });

    it('UNTRUSTED не доминирует над PARTIAL', () => {
      expect(
        dominates(trustLevels.UNTRUSTED as TrustLevel, trustLevels.PARTIAL as TrustLevel),
      ).toBe(false);
    });

    it('UNTRUSTED не доминирует над TRUSTED', () => {
      expect(
        dominates(trustLevels.UNTRUSTED as TrustLevel, trustLevels.TRUSTED as TrustLevel),
      ).toBe(false);
    });

    it('PARTIAL не доминирует над TRUSTED', () => {
      expect(
        dominates(trustLevels.PARTIAL as TrustLevel, trustLevels.TRUSTED as TrustLevel),
      ).toBe(false);
    });

    it('выбрасывает ошибку для неизвестного уровня (через meetTrust)', () => {
      const unknownLevel = Symbol('UNKNOWN') as TrustLevel;
      expect(() => {
        dominates(unknownLevel, trustLevels.UNTRUSTED as TrustLevel);
      }).toThrow('Unknown TrustLevel detected in meetTrust');
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .withLevel(trustLevels.TRUSTED as TrustLevel, 'TRUSTED')
        .build();

      expect(
        dominates(
          trustLevels.TRUSTED as TrustLevel,
          trustLevels.UNTRUSTED as TrustLevel,
          customRegistry,
        ),
      ).toBe(true);
    });
  });

  describe('Multi-registry архитектура', () => {
    it('создает независимые registry', () => {
      const registry1 = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .build();

      const registry2 = createTrustLevelRegistry()
        .withLevel(trustLevels.PARTIAL as TrustLevel, 'PARTIAL')
        .build();

      expect(registry1).not.toBe(registry2);
      expect(registry1.order).toHaveLength(1);
      expect(registry2.order).toHaveLength(1);
    });

    it('каждый registry имеет свои уровни', () => {
      const customLevel1 = Symbol('CUSTOM1') as TrustLevel;
      const customLevel2 = Symbol('CUSTOM2') as TrustLevel;

      const registry1 = createTrustLevelRegistry()
        .withLevel(customLevel1, 'CUSTOM1')
        .build();

      const registry2 = createTrustLevelRegistry()
        .withLevel(customLevel2, 'CUSTOM2')
        .build();

      expect(isTrustLevel(customLevel1, registry1)).toBe(true);
      expect(isTrustLevel(customLevel1, registry2)).toBe(false);
      expect(isTrustLevel(customLevel2, registry1)).toBe(false);
      expect(isTrustLevel(customLevel2, registry2)).toBe(true);
    });
  });

  describe('Edge cases и защита от подделок', () => {
    it('isTrustLevel защищает от подделки через строку', () => {
      expect(isTrustLevel('UNTRUSTED')).toBe(false);
    });

    it('isTrustLevel защищает от подделки через число', () => {
      expect(isTrustLevel(0)).toBe(false);
      expect(isTrustLevel(1)).toBe(false);
      expect(isTrustLevel(2)).toBe(false);
    });

    it('isTrustLevel защищает от подделки через объект', () => {
      expect(isTrustLevel({ level: 'UNTRUSTED' })).toBe(false);
    });

    it('getTrustLevelName возвращает UNKNOWN для поддельного уровня', () => {
      const fakeLevel = Symbol('FAKE') as TrustLevel;
      expect(getTrustLevelName(fakeLevel)).toBe('UNKNOWN');
    });

    it('meetTrust выбрасывает ошибку для поддельного уровня', () => {
      const fakeLevel = Symbol('FAKE') as TrustLevel;
      expect(() => {
        meetTrust(fakeLevel, trustLevels.UNTRUSTED as TrustLevel);
      }).toThrow();
    });
  });
});
