/**
 * @vitest-environment node
 */

import { describe, expect, expectTypeOf, it } from 'vitest';

import type { BotsStoreBatchUpdate } from '../../../src/contracts/BotsStoreContract.js';
import { botsStoreContractVersion } from '../../../src/contracts/BotsStoreContract.js';

type Extends<A, B> = A extends B ? true : false;
type Assert<T extends true> = T;

describe('BotsStoreContract', () => {
  it('botsStoreContractVersion экспортирует ожидаемую версию', () => {
    expect(botsStoreContractVersion).toBe(1);
  });

  it('BotsStoreBatchUpdate: union покрывает все type-variants', () => {
    type Types = BotsStoreBatchUpdate['type'];
    const _types: Assert<
      Extends<
        Types,
        | 'reset'
        | 'setBotsList'
        | 'upsertBot'
        | 'setCreateState'
        | 'setUpdateState'
        | 'setDeleteState'
      >
    > = true;
    void _types;

    expectTypeOf<Extract<BotsStoreBatchUpdate, { type: 'reset'; }>>().toBeObject();
    expectTypeOf<Extract<BotsStoreBatchUpdate, { type: 'setBotsList'; }>>().toBeObject();
    expectTypeOf<Extract<BotsStoreBatchUpdate, { type: 'upsertBot'; }>>().toBeObject();
    expectTypeOf<Extract<BotsStoreBatchUpdate, { type: 'setCreateState'; }>>().toBeObject();
    expectTypeOf<Extract<BotsStoreBatchUpdate, { type: 'setUpdateState'; }>>().toBeObject();
    expectTypeOf<Extract<BotsStoreBatchUpdate, { type: 'setDeleteState'; }>>().toBeObject();
  });
});
