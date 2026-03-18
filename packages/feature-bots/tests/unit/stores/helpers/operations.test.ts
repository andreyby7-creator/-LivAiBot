/**
 * @file Unit tests for stores/helpers/operations.ts
 */

import { describe, expect, it } from 'vitest';

import { setOperation } from '../../../../src/stores/helpers/operations.js';
import type { BotsState } from '../../../../src/types/bots.js';

describe('setOperation', () => {
  it('обновляет только указанный ключ operations и не мутирует исходный state', () => {
    const create0 = { status: 'idle' } as const;
    const update0 = { status: 'idle' } as const;
    const delete0 = { status: 'idle' } as const;
    const entities0 = Object.freeze({});

    const state0: BotsState = {
      entities: entities0 as any,
      operations: {
        create: create0 as any,
        update: update0 as any,
        delete: delete0 as any,
      },
    };

    const nextCreate = { status: 'loading', operation: 'create' } as const;
    const state1 = setOperation('create', nextCreate as any)(state0);

    // новый объект состояния
    expect(state1).not.toBe(state0);
    expect(state1.operations).not.toBe(state0.operations);

    // entities сохраняются ссылочно (мы не трогаем entities)
    expect(state1.entities).toBe(state0.entities);

    // обновился только нужный ключ
    expect(state1.operations.create).toBe(nextCreate);
    expect(state1.operations.update).toBe(state0.operations.update);
    expect(state1.operations.delete).toBe(state0.operations.delete);

    // исходный state не изменён
    expect(state0.operations.create).toBe(create0);
  });

  it('работает для других ключей (например, delete)', () => {
    const state0: BotsState = {
      entities: {} as any,
      operations: {
        create: { status: 'idle' } as any,
        update: { status: 'idle' } as any,
        delete: { status: 'idle' } as any,
      },
    };

    const nextDelete = { status: 'success', data: undefined } as const;
    const state1 = setOperation('delete', nextDelete as any)(state0);

    expect(state1.operations.delete).toBe(nextDelete);
    expect(state1.operations.create).toBe(state0.operations.create);
    expect(state1.operations.update).toBe(state0.operations.update);
  });
});
