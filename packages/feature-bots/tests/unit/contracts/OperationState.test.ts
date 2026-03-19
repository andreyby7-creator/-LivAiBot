/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type {
  OperationError,
  OperationLoading,
  OperationState,
  OperationSuccess,
} from '../../../src/contracts/OperationState.js';
import { operationStateContractVersion } from '../../../src/contracts/OperationState.js';

type Extends<A, B> = A extends B ? true : false;
type Assert<T extends true> = T;

describe('OperationState', () => {
  it('экспортирует версию контракта', () => {
    expect(operationStateContractVersion).toBe(1);
  });

  it('OperationLoading/OperationSuccess/OperationError формируют корректные структуры', () => {
    type L = OperationLoading<'create'>;
    const _l: Assert<Extends<L, { status: 'loading'; operation: 'create'; }>> = true;
    void _l;

    type S = OperationSuccess<number>;
    const _s: Assert<Extends<S, { status: 'success'; data: number; }>> = true;
    void _s;

    type E = OperationError<string>;
    const _e: Assert<Extends<E, { status: 'error'; error: string; }>> = true;
    void _e;
  });

  it('OperationState — union loading → success/error', () => {
    type State = OperationState<number, string, 'create'>;

    type LoadingPart = Extract<State, { status: 'loading'; }>;
    const _loading: Assert<Extends<LoadingPart, { status: 'loading'; operation: 'create'; }>> =
      true;
    void _loading;

    type SuccessPart = Extract<State, { status: 'success'; }>;
    const _success: Assert<Extends<SuccessPart, { status: 'success'; data: number; }>> = true;
    void _success;

    type ErrorPart = Extract<State, { status: 'error'; }>;
    const _error: Assert<Extends<ErrorPart, { status: 'error'; error: string; }>> = true;
    void _error;
  });
});
