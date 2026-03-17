/**
 * @file tests for core/src/state-kit/operation.ts
 */

import { describe, expect, it } from 'vitest';

import type { OperationState } from '../../src/state-kit/operation.js';
import {
  failure,
  idle,
  isError,
  isIdle,
  isLoading,
  isSuccess,
  loading,
  reset,
  success,
} from '../../src/state-kit/operation.js';

type Data = Readonly<{ value: number; }>;
type Op = 'create' | 'update';
type Err = Readonly<{ message: string; }>;

describe('operation state constructors', () => {
  it('idle создаёт состояние с status="idle"', () => {
    const state = idle<Data, Op, Err>();
    expect(state).toEqual({ status: 'idle' });
  });

  it('loading создаёт состояние с status="loading" и operation', () => {
    const state = loading<Op>('create');
    expect(state).toEqual({ status: 'loading', operation: 'create' });
  });

  it('success создаёт состояние с status="success" и данными', () => {
    const payload: Data = { value: 42 };
    const state = success(payload);
    expect(state).toEqual({ status: 'success', data: payload });
  });

  it('failure создаёт состояние с status="error" и ошибкой', () => {
    const error: Err = { message: 'boom' };
    const state = failure(error);
    expect(state).toEqual({ status: 'error', error });
  });
});

describe('operation state type guards', () => {
  const states: OperationState<Data, Op, Err>[] = [
    idle<Data, Op, Err>(),
    loading<Op>('update') as OperationState<Data, Op, Err>,
    success<Data>({ value: 1 }) as OperationState<Data, Op, Err>,
    failure<Err>({ message: 'err' }) as OperationState<Data, Op, Err>,
  ];

  it('isIdle корректно распознаёт только idle', () => {
    const results = states.map((s) => isIdle(s));
    expect(results).toEqual([true, false, false, false]);
  });

  it('isLoading корректно распознаёт только loading', () => {
    const results = states.map((s) => isLoading(s));
    expect(results).toEqual([false, true, false, false]);
  });

  it('isSuccess корректно распознаёт только success', () => {
    const results = states.map((s) => isSuccess(s));
    expect(results).toEqual([false, false, true, false]);
  });

  it('isError корректно распознаёт только error', () => {
    const results = states.map((s) => isError(s));
    expect(results).toEqual([false, false, false, true]);
  });
});

describe('reset', () => {
  it('reset всегда возвращает строго idle-состояние', () => {
    const state = reset();
    expect(state).toEqual({ status: 'idle' });
    expect(isIdle(state)).toBe(true);
  });
});
