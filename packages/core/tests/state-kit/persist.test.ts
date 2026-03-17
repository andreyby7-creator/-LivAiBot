/**
 * @file tests for core/src/state-kit/persist.ts
 */

import { describe, expect, it } from 'vitest';

import { createNoopStorage, mergePreservingActions } from '../../src/state-kit/persist.js';

type State = Readonly<{
  actions: Readonly<{
    increment: () => void;
  }>;
  count: number;
  nested?: { value: number; };
}>;

const baseState: State = {
  actions: Object.freeze({
    increment: () => {
      throw new Error('should not be called in tests');
    },
  }),
  count: 1,
  nested: { value: 1 },
} as const;

describe('mergePreservingActions — слияние состояния с сохранением actions', () => {
  it('возвращает текущий state, если persisted не является plain-объектом', () => {
    const samples: unknown[] = [null, 42, 'str', true, [], () => {}, new Date()];
    samples.forEach((persisted) => {
      const res = mergePreservingActions(persisted, baseState);
      expect(res).toBe(baseState);
    });
  });

  it('игнорирует неэнумерируемые свойства и сохраняет actions', () => {
    const persisted = Object.create(Object.prototype) as Record<string, unknown>;
    Object.defineProperty(persisted, 'count', {
      value: 10,
      enumerable: true,
    });
    Object.defineProperty(persisted, 'hidden', {
      value: 'secret',
      enumerable: false,
    });

    const res = mergePreservingActions(persisted, baseState);
    expect(res.count).toBe(10);
    expect((res as any).hidden).toBeUndefined();
    expect(res.actions).toBe(baseState.actions);
  });

  it('делает только поверхностный merge и не мёрджит вложенные объекты', () => {
    const persisted = {
      count: 5,
      nested: { other: 123 },
    };

    const res = mergePreservingActions(persisted, baseState);
    expect(res.count).toBe(5);
    // nested object полностью заменяется, а не мёрджится
    expect(res.nested).toEqual({ other: 123 });
  });

  it('игнорирует persisted.actions и всегда оставляет current.actions', () => {
    const otherActions = {
      increment: () => {
        // no-op
      },
    };
    const persisted = {
      count: 2,
      actions: otherActions,
    };

    const res = mergePreservingActions(persisted, baseState);
    expect(res.count).toBe(2);
    expect(res.actions).toBe(baseState.actions);
  });
});

describe('createNoopStorage — SSR-safe no-op storage', () => {
  it('возвращает хранилище с getItem=null и no-op set/remove', () => {
    const storage = createNoopStorage();

    expect(storage.getItem('any')).toBeNull();

    // setItem/removeItem не должны кидать
    storage.setItem('k', 'v');
    storage.removeItem('k');

    // повторный getItem всё так же null
    expect(storage.getItem('k')).toBeNull();
  });
});
