/**
 * @file Unit тесты для Structural Clone
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';
import { isCloneable, structuralClone } from '../../src/data-safety/structural-clone.js';

describe('Structural Clone', () => {
  describe('isCloneable', () => {
    describe('примитивы', () => {
      it('возвращает true для null', () => {
        expect(isCloneable(null)).toBe(true);
      });

      it('возвращает true для undefined', () => {
        expect(isCloneable(undefined)).toBe(true);
      });

      it('возвращает true для string', () => {
        expect(isCloneable('test')).toBe(true);
        expect(isCloneable('')).toBe(true);
      });

      it('возвращает true для number', () => {
        expect(isCloneable(0)).toBe(true);
        expect(isCloneable(42)).toBe(true);
        expect(isCloneable(-1)).toBe(true);
        expect(isCloneable(3.14)).toBe(true);
      });

      it('возвращает true для boolean', () => {
        expect(isCloneable(true)).toBe(true);
        expect(isCloneable(false)).toBe(true);
      });
    });

    describe('несериализуемые типы', () => {
      it('возвращает false для функций', () => {
        expect(isCloneable(() => {})).toBe(false);
        expect(isCloneable(function named() {})).toBe(false);
        expect(isCloneable(async () => {})).toBe(false);
      });

      it('возвращает false для Symbol', () => {
        expect(isCloneable(Symbol('test'))).toBe(false);
        expect(isCloneable(Symbol())).toBe(false);
      });
    });

    describe('объекты', () => {
      it('возвращает true для Date', () => {
        expect(isCloneable(new Date())).toBe(true);
        expect(isCloneable(new Date(0))).toBe(true);
      });

      it('возвращает true для RegExp', () => {
        expect(isCloneable(/test/)).toBe(true);
        expect(isCloneable(new RegExp('test', 'gi'))).toBe(true);
      });

      it('возвращает true для Map', () => {
        expect(isCloneable(new Map())).toBe(true);
        expect(isCloneable(new Map([['a', 1]]))).toBe(true);
      });

      it('возвращает true для Set', () => {
        expect(isCloneable(new Set())).toBe(true);
        expect(isCloneable(new Set([1, 2, 3]))).toBe(true);
      });

      it('возвращает true для массивов', () => {
        expect(isCloneable([])).toBe(true);
        expect(isCloneable([1, 2, 3])).toBe(true);
      });

      it('возвращает true для plain objects', () => {
        expect(isCloneable({})).toBe(true);
        expect(isCloneable({ a: 1 })).toBe(true);
        expect(isCloneable(Object.create(null))).toBe(true);
      });

      it('возвращает false для объектов с прототипом', () => {
        // eslint-disable-next-line functional/no-classes
        class TestClass {}
        expect(isCloneable(new TestClass())).toBe(false);
      });

      it('возвращает false для необъектных типов (fallback)', () => {
        // Покрываем строку 83: return false в конце isCloneable
        // Это происходит когда typeof value !== 'object' и не является примитивом
        // В нормальных условиях TypeScript это не допустит, но покрываем для полноты
        // Используем bigint как пример необъектного типа, который не является примитивом из проверки
        if (typeof BigInt !== 'undefined') {
          const value = BigInt(123) as unknown;
          expect(isCloneable(value)).toBe(false);
        }
      });
    });
  });

  describe('structuralClone', () => {
    describe('примитивы', () => {
      it('клонирует null', () => {
        const result = structuralClone(null);
        expect(result).toBe(null);
      });

      it('клонирует undefined', () => {
        const result = structuralClone(undefined);
        expect(result).toBe(undefined);
      });

      it('клонирует string', () => {
        const original = 'test';
        const cloned = structuralClone(original);
        expect(cloned).toBe(original);
        expect(cloned === original).toBe(true);
      });

      it('клонирует number', () => {
        const original = 42;
        const cloned = structuralClone(original);
        expect(cloned).toBe(original);
      });

      it('клонирует boolean', () => {
        expect(structuralClone(true)).toBe(true);
        expect(structuralClone(false)).toBe(false);
      });
    });

    describe('Date', () => {
      it('клонирует Date объект', () => {
        const original = new Date('2023-01-01');
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.getTime()).toBe(original.getTime());
        expect(cloned instanceof Date).toBe(true);
      });

      it('клонированный Date независим от оригинала', () => {
        const original = new Date();
        const cloned = structuralClone(original);
        original.setTime(0);
        expect(cloned.getTime()).not.toBe(0);
      });
    });

    describe('RegExp', () => {
      it('клонирует RegExp объект', () => {
        const original = /test/gi;
        // eslint-disable-next-line fp/no-mutation
        original.lastIndex = 5;
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.source).toBe(original.source);
        expect(cloned.flags).toBe(original.flags);
        expect(cloned.lastIndex).toBe(original.lastIndex);
      });

      it('клонированный RegExp независим от оригинала', () => {
        const original = /test/g;
        const cloned = structuralClone(original);
        // eslint-disable-next-line fp/no-mutation
        original.lastIndex = 10;
        expect(cloned.lastIndex).not.toBe(10);
      });
    });

    describe('Map', () => {
      it('клонирует пустой Map', () => {
        const original = new Map();
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.size).toBe(0);
      });

      it('клонирует Map с примитивными значениями', () => {
        const original = new Map([
          ['a', 1],
          ['b', 2],
        ]);
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.size).toBe(2);
        expect(cloned.get('a')).toBe(1);
        expect(cloned.get('b')).toBe(2);
      });

      it('клонирует Map с объектами', () => {
        const original = new Map([
          ['key1', { a: 1 }],
          ['key2', { b: 2 }],
        ]);
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.get('key1')).not.toBe(original.get('key1'));
        expect(cloned.get('key1')).toEqual({ a: 1 });
      });

      it('клонированный Map независим от оригинала', () => {
        const original = new Map([['a', 1]]);
        const cloned = structuralClone(original);
        original.set('b', 2);
        expect(cloned.size).toBe(1);
        expect(cloned.has('b')).toBe(false);
      });
    });

    describe('Set', () => {
      it('клонирует пустой Set', () => {
        const original = new Set();
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.size).toBe(0);
      });

      it('клонирует Set с примитивными значениями', () => {
        const original = new Set([1, 2, 3]);
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.size).toBe(3);
        expect(cloned.has(1)).toBe(true);
        expect(cloned.has(2)).toBe(true);
        expect(cloned.has(3)).toBe(true);
      });

      it('клонирует Set с объектами', () => {
        const obj1 = { a: 1 };
        const obj2 = { b: 2 };
        const original = new Set([obj1, obj2]);
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.size).toBe(2);
        const clonedArray = Array.from(cloned);
        expect(clonedArray[0]).not.toBe(obj1);
        expect(clonedArray[0]).toEqual({ a: 1 });
      });

      it('клонированный Set независим от оригинала', () => {
        const original = new Set([1, 2]);
        const cloned = structuralClone(original);
        original.add(3);
        expect(cloned.size).toBe(2);
        expect(cloned.has(3)).toBe(false);
      });
    });

    describe('Array', () => {
      it('клонирует пустой массив', () => {
        const original: unknown[] = [];
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned).toEqual([]);
      });

      it('клонирует массив с примитивами', () => {
        const original = [1, 2, 3];
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned).toEqual([1, 2, 3]);
      });

      it('клонирует массив с объектами', () => {
        const original = [{ a: 1 }, { b: 2 }];
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned[0]).not.toBe(original[0]);
        expect(cloned[0]).toEqual({ a: 1 });
      });

      it('клонированный массив независим от оригинала', () => {
        const original = [1, 2, 3];
        const cloned = structuralClone(original);
        original.push(4);
        expect(cloned.length).toBe(3);
        expect(cloned).toEqual([1, 2, 3]);
      });

      it('клонированный массив readonly', () => {
        const original = [1, 2, 3];
        const cloned = structuralClone(original);
        // TypeScript должен запретить мутацию, но в runtime это возможно
        expect(() => {
          (cloned as number[]).push(4);
        }).not.toThrow();
      });
    });

    describe('Plain objects', () => {
      it('клонирует пустой объект', () => {
        const original = {};
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned).toEqual({});
      });

      it('клонирует объект с примитивными значениями', () => {
        const original = { a: 1, b: 'test', c: true };
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned).toEqual({ a: 1, b: 'test', c: true });
      });

      it('клонирует объект с вложенными объектами', () => {
        const original = { a: { b: { c: 1 } } };
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.a).not.toBe(original.a);
        expect(cloned.a.b).not.toBe(original.a.b);
        expect(cloned).toEqual({ a: { b: { c: 1 } } });
      });

      it('клонированный объект независим от оригинала', () => {
        const original: Record<string, number> = { a: 1, b: 2 };
        const cloned = structuralClone(original);
        // eslint-disable-next-line fp/no-mutation
        original['c'] = 3;
        expect('c' in cloned).toBe(false);
      });
    });

    describe('циклические ссылки', () => {
      it('обрабатывает циклические ссылки в объектах', () => {
        const original: Record<string, unknown> = { a: 1 };
        // eslint-disable-next-line fp/no-mutation
        original['self'] = original;
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned['self']).toBe(cloned);
        expect(cloned['self']).not.toBe(original);
      });

      it('обрабатывает циклические ссылки в массивах', () => {
        const original: unknown[] = [1, 2];
        original.push(original);
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned[2]).toBe(cloned);
        expect(cloned[2]).not.toBe(original);
      });

      it('обрабатывает сложные циклические ссылки', () => {
        const obj1: Record<string, unknown> = { a: 1 };
        const obj2: Record<string, unknown> = { b: 2 };
        // eslint-disable-next-line fp/no-mutation
        obj1['ref'] = obj2;
        // eslint-disable-next-line fp/no-mutation
        obj2['ref'] = obj1;
        const cloned = structuralClone(obj1);
        expect(cloned).not.toBe(obj1);
        expect(cloned['ref']).not.toBe(obj2);
        const clonedRef = cloned['ref'] as Record<string, unknown>;
        expect(clonedRef['ref']).toBe(cloned);
        expect(clonedRef).toEqual({ b: 2, ref: cloned });
      });
    });

    describe('Prototype Pollution защита', () => {
      it('фильтрует __proto__ ключ', () => {
        // Используем Object.create(null) чтобы избежать проблем с прототипом
        const original = Object.create(null) as Record<string, unknown>;
        // eslint-disable-next-line fp/no-mutation
        original['a'] = 1;
        // eslint-disable-next-line fp/no-mutation
        original['__proto__'] = { polluted: true };
        const cloned = structuralClone(original);
        expect(cloned).not.toHaveProperty('__proto__');
        expect(cloned).toEqual({ a: 1 });
      });

      it('фильтрует constructor ключ', () => {
        const original: Record<string, unknown> = {
          a: 1,
          constructor: { polluted: true },
        };
        const cloned = structuralClone(original);
        expect(cloned).not.toHaveProperty('constructor');
        expect(cloned).toEqual({ a: 1 });
      });

      it('фильтрует prototype ключ', () => {
        const original: Record<string, unknown> = {
          a: 1,
          prototype: { polluted: true },
        };
        const cloned = structuralClone(original);
        expect(cloned).not.toHaveProperty('prototype');
        expect(cloned).toEqual({ a: 1 });
      });

      it('фильтрует все опасные ключи одновременно', () => {
        const original: Record<string, unknown> = {
          a: 1,
          constructor: { polluted: true },
          prototype: { polluted: true },
        };
        // __proto__ может изменить прототип объекта, поэтому используем только constructor и prototype
        const cloned = structuralClone(original);
        expect(cloned).not.toHaveProperty('constructor');
        expect(cloned).not.toHaveProperty('prototype');
        expect(cloned).toEqual({ a: 1 });
      });
    });

    describe('комплексные структуры', () => {
      it('клонирует сложную вложенную структуру', () => {
        const original = {
          a: 1,
          b: [2, 3, { c: 4 }],
          d: new Map([['e', new Set([5, 6])]]),
          f: new Date('2023-01-01'),
          g: /test/gi,
        };
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.b).not.toBe(original.b);
        expect(cloned.d).not.toBe(original.d);
        expect(cloned.f).not.toBe(original.f);
        expect(cloned.g).not.toBe(original.g);
        expect(cloned).toEqual(original);
      });

      it('клонирует объект с null и undefined значениями', () => {
        const original = {
          a: null,
          b: undefined,
          c: 1,
        };
        const cloned = structuralClone(original);
        expect(cloned).toEqual({ a: null, b: undefined, c: 1 });
      });
    });

    describe('ошибки для несериализуемых типов', () => {
      it('выбрасывает ошибку для функций', () => {
        expect(() => {
          structuralClone(() => {});
        }).toThrow('Cannot clone non-serializable type: function');
      });

      it('выбрасывает ошибку для Symbol', () => {
        expect(() => {
          structuralClone(Symbol('test'));
        }).toThrow('Cannot clone non-serializable type: symbol');
      });

      it('выбрасывает ошибку для async функций', () => {
        expect(() => {
          structuralClone(async () => {});
        }).toThrow('Cannot clone non-serializable type: function');
      });
    });

    describe('ошибки для неизвестных типов объектов', () => {
      it('выбрасывает ошибку для классов', () => {
        // eslint-disable-next-line functional/no-classes
        class TestClass {
          constructor(public value: number) {}
        }
        expect(() => {
          structuralClone(new TestClass(42));
        }).toThrow('Cannot clone object of type TestClass');
      });

      it('выбрасывает ошибку для объектов с кастомным прототипом', () => {
        const proto = { customProp: 'test' };
        const obj = Object.create(proto) as Record<string, number>;
        // eslint-disable-next-line fp/no-mutation
        obj['a'] = 1;
        expect(() => {
          structuralClone(obj);
        }).toThrow('Cannot clone object of type');
      });

      it('выбрасывает ошибку для объектов с кастомным прототипом (без constructor)', () => {
        // Покрываем ветку когда constructor?.name === undefined
        const proto = Object.create(null);
        const obj = Object.create(proto) as Record<string, number>;
        // eslint-disable-next-line fp/no-mutation
        obj['a'] = 1;
        expect(() => {
          structuralClone(obj);
        }).toThrow('Cannot clone object of type Unknown');
      });
    });

    describe('ошибки для неизвестных типов (edge case)', () => {
      it('выбрасывает ошибку для необъектных типов (fallback)', () => {
        // Покрываем строку 292: throw new Error для неизвестных типов
        // Это происходит когда typeof value !== 'object' и не является примитивом/функцией/Symbol
        // В нормальных условиях TypeScript это не допустит, но покрываем для полноты
        if (typeof BigInt !== 'undefined') {
          const value = BigInt(123) as unknown;
          expect(() => {
            structuralClone(value);
          }).toThrow('Cannot clone value of type bigint');
        }
      });
    });

    describe('visited WeakMap', () => {
      it('использует переданный visited WeakMap для обработки циклических ссылок', () => {
        const visited = new WeakMap<object, unknown>();
        const obj: Record<string, unknown> = { a: 1 };
        // eslint-disable-next-line fp/no-mutation
        obj['self'] = obj;
        const cloned = structuralClone(obj, visited);
        expect(cloned['self']).toBe(cloned);
        expect(cloned).toEqual({ a: 1, self: cloned });
      });

      it('разные visited WeakMap создают разные клоны', () => {
        const obj = { a: 1 };
        const cloned1 = structuralClone(obj, new WeakMap());
        const cloned2 = structuralClone(obj, new WeakMap());
        expect(cloned1).not.toBe(cloned2);
        expect(cloned1).toEqual(cloned2);
      });
    });

    describe('edge cases', () => {
      it('клонирует объект с null прототипом', () => {
        const original = Object.create(null) as Record<string, number>;
        // eslint-disable-next-line fp/no-mutation
        original['a'] = 1;
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned).toEqual({ a: 1 });
      });

      it('клонирует Map с объектными ключами', () => {
        const key1 = { id: 1 };
        const key2 = { id: 2 };
        const original = new Map([
          [key1, 'value1'],
          [key2, 'value2'],
        ]);
        const cloned = structuralClone(original);
        expect(cloned.size).toBe(2);
        const clonedKeys = Array.from(cloned.keys());
        expect(clonedKeys[0]).not.toBe(key1);
        expect(clonedKeys[0]).toEqual({ id: 1 });
      });

      it('клонирует Set с объектными значениями', () => {
        const obj1 = { id: 1 };
        const obj2 = { id: 2 };
        const original = new Set([obj1, obj2]);
        const cloned = structuralClone(original);
        expect(cloned.size).toBe(2);
        const clonedArray = Array.from(cloned);
        expect(clonedArray[0]).not.toBe(obj1);
        expect(clonedArray[0]).toEqual({ id: 1 });
      });

      it('клонирует массив с различными типами', () => {
        const original = [
          1,
          'test',
          true,
          null,
          undefined,
          { a: 1 },
          [2, 3],
          new Date('2023-01-01'),
          /test/gi,
        ];
        const cloned = structuralClone(original);
        expect(cloned).not.toBe(original);
        expect(cloned).toEqual(original);
      });
    });
  });
});
